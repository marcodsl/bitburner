import {z} from 'zod/v4';

export const HeaderSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.number(),
});

const createRequestSchema = <M extends string, P extends z.ZodObject>(
  method: M,
  schema: P,
) =>
  HeaderSchema.extend({
    method: z.literal(method),
    params: schema,
  });

const createResponseSchema = <P extends z.ZodType>(result: P) =>
  HeaderSchema.extend({result: result}).or(
    HeaderSchema.extend({
      error: z.object({
        code: z.number(),
        message: z.string(),
        data: z.any().optional(),
      }),
    }),
  );

export function createMethodSchema<
  M extends string,
  P extends z.ZodRawShape,
  R extends z.ZodType,
>(method: M, params: P, result: R) {
  return {
    request: createRequestSchema(method, z.object(params)),
    response: createResponseSchema(result),
  };
}

export type RequestSchema<M extends string, P extends z.ZodObject> = ReturnType<
  typeof createRequestSchema<M, P>
>;

export type ResponseSchema<R extends z.ZodType> = ReturnType<
  typeof createResponseSchema<R>
>;

export type MethodSchema<
  M extends string,
  P extends z.ZodObject,
  R extends z.ZodType,
> = {
  request: RequestSchema<M, P>;
  response: ResponseSchema<R>;
};

export const GetAllFilesSchema = createMethodSchema(
  'getAllFiles',
  {
    server: z.string(),
  },
  z.array(
    z.object({
      filename: z.string(),
      content: z.string(),
    }),
  ),
);

export const GetFileSchema = createMethodSchema(
  'getFile',
  {
    filename: z.string(),
    server: z.string(),
  },
  z.number(),
);

export const PushFileSchema = createMethodSchema(
  'pushFile',
  {
    filename: z.string(),
    content: z.string(),
    server: z.string(),
  },
  z.literal('OK'),
);

export const DeleteFileSchema = createMethodSchema(
  'deleteFile',
  {
    filename: z.string(),
    server: z.string(),
  },
  z.literal('OK'),
);

export const GetFileNamesSchema = createMethodSchema(
  'getFileNames',
  {
    server: z.string(),
  },
  z.array(z.string()),
);

export const CalculateRamSchema = createMethodSchema(
  'calculateRam',
  {
    filename: z.string(),
    server: z.string(),
  },
  z.number(),
);

export const GetDefinitionFileSchema = createMethodSchema(
  'getDefinitionFile',
  {},
  z.string(),
);
