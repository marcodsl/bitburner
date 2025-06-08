import {z} from 'zod/v4';
import {
  CalculateRamSchema,
  DeleteFileSchema,
  GetAllFilesSchema,
  GetDefinitionFileSchema,
  GetFileNamesSchema,
  GetFileSchema,
  HeaderSchema,
  PushFileSchema,
  type MethodSchema,
  type ResponseSchema,
} from './rpc';
import {type RemoteApiConfig, defaultConfig} from './config';
import {Logger} from './logger';

export class RemoteApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public data?: any,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

export class RemoteApi {
  private socket: Bun.ServerWebSocket<unknown> | null = null;
  private server: Bun.Server | null = null;
  private pendingRequests = new Map<
    number,
    {
      schema: ResponseSchema<unknown & z.ZodType>;
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private socketReadyPromise: Promise<void>;
  private socketReadyResolver: (() => void) | null = null;
  private reconnectAttempt = 0;
  private logger: Logger;

  constructor(private config: RemoteApiConfig = defaultConfig) {
    this.logger = new Logger(config);
    this.socketReadyPromise = new Promise(resolve => {
      this.socketReadyResolver = resolve;
    });
    this.startServer();
  }

  private startServer() {
    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,
      websocket: {
        open: this.handleOpen.bind(this),
        message: this.handleMessage.bind(this),
        close: this.handleClose.bind(this),
      },
      fetch: (req, server) => {
        server.upgrade(req);
        return undefined;
      },
    });

    this.logger.info(
      `Server started on ${this.config.host}:${this.config.port}`,
    );
  }

  private handleOpen(ws: Bun.ServerWebSocket<unknown>) {
    if (this.socket) {
      ws.close(1011, 'Already connected');
      this.logger.warn('WebSocket connection already established.');

      return;
    }

    this.socket = ws;
    this.reconnectAttempt = 0;

    this.logger.debug('WebSocket connection opened.');

    if (this.socketReadyResolver) {
      this.socketReadyResolver();
      this.socketReadyResolver = null;
    }
  }

  private async handleMessage(
    _ws: Bun.ServerWebSocket<unknown>,
    message: string | Buffer,
  ) {
    if (typeof message !== 'string') {
      this.logger.warn('Received non-string message:', message);
      return;
    }

    this.logger.debug(`Received message (length: ${message.length})`);

    try {
      const object = JSON.parse(message);
      const header = HeaderSchema.loose().safeParse(object);

      if (!header.success) {
        this.logger.warn('Invalid JSON-RPC header format:', header.error);
        return;
      }

      if (!this.pendingRequests.has(header.data.id)) {
        this.logger.warn(
          'No matching request found for header ID:',
          header.data.id,
        );
        return;
      }

      const {
        reject,
        resolve,
        timeout,
        schema: responseSchema,
      } = this.pendingRequests.get(header.data.id)!;

      clearTimeout(timeout);
      this.pendingRequests.delete(header.data.id);

      const response = responseSchema.safeParse(object);

      if (!response.success) {
        this.logger.warn('Invalid response format:', response.error);
        reject(new RemoteApiError('Invalid response format'));
        return;
      }

      if ('error' in response.data) {
        this.logger.warn('Error in response:', response.data.error);
        reject(
          new RemoteApiError(
            response.data.error.message,
            response.data.error.code,
            response.data.error.data,
          ),
        );
        return;
      }

      resolve(response.data.result);
    } catch (error) {
      this.logger.error('Error processing message:', error);
    }
  }

  private handleClose() {
    this.socket = null;
    this.rejectAllPending('WebSocket connection closed.');
    this.logger.warn('WebSocket connection closed.');

    if (this.reconnectAttempt < this.config.reconnectAttempts) {
      this.reconnectAttempt++;
      this.logger.info(
        `Attempting to reconnect (${this.reconnectAttempt}/${this.config.reconnectAttempts})...`,
      );

      setTimeout(() => {
        this.socketReadyPromise = new Promise(resolve => {
          this.socketReadyResolver = resolve;
        });
      }, this.config.reconnectDelay);
    }
  }

  private rejectAllPending(reason: string) {
    for (const {reject, timeout} of this.pendingRequests.values()) {
      clearTimeout(timeout);
      reject(new RemoteApiError(reason));
    }

    this.pendingRequests.clear();
  }

  private createMethod<
    M extends string,
    P extends z.ZodObject,
    R extends z.ZodType,
  >(method: MethodSchema<M, P, R>) {
    return async (params: z.infer<P>): Promise<z.infer<R>> => {
      await this.socketReadyPromise;

      const request = method.request.parse({
        jsonrpc: '2.0',
        id: Bun.nanoseconds(),
        method: method.request.shape.method.value,
        params: params || {},
      });

      this.logger.debug(
        `Sending request for method: ${request.method}`,
        params,
      );

      return new Promise<z.infer<R>>((resolve, reject) => {
        if (!this.socket) {
          reject(new RemoteApiError('WebSocket connection is not open'));
          return;
        }

        const timeout = setTimeout(() => {
          if (this.pendingRequests.has(request.id)) {
            this.pendingRequests.delete(request.id);
            reject(
              new RemoteApiError(
                `Timeout waiting for response to request ID ${request.id}`,
              ),
            );
          }
        }, this.config.requestTimeout);

        this.pendingRequests.set(request.id, {
          resolve,
          reject,
          timeout,
          schema: method.response,
        });

        const rawRequest = JSON.stringify(request);
        this.logger.debug(`Sending request (ID: ${request.id})`);
        this.socket.send(rawRequest);
      });
    };
  }

  public async shutdown(): Promise<void> {
    this.rejectAllPending('Server shutting down');

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }

    this.logger.info('RPC server shut down');
  }

  // Bitburner API methods
  public calculateRam = this.createMethod(CalculateRamSchema);
  public pushFile = this.createMethod(PushFileSchema);
  public getFile = this.createMethod(GetFileSchema);
  public getAllFiles = this.createMethod(GetAllFilesSchema);
  public getFileNames = this.createMethod(GetFileNamesSchema);
  public deleteFile = this.createMethod(DeleteFileSchema);
  public getDefinitionFile = () =>
    this.createMethod(GetDefinitionFileSchema)({});
}

export const createRemoteApi = async (config?: Partial<RemoteApiConfig>) => {
  return new RemoteApi({...defaultConfig, ...config});
};
