import { publicProcedure } from "../trpc";

export const helloRouter = {
  get: publicProcedure.query(() => {
    return {
      message: "Hello, world from tRPC!",
    };
  }),
};
