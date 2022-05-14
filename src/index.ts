import { ApolloServer } from "apollo-server-express";
import { createServer } from "http";
import express from "express";
import { ApolloServerPluginDrainHttpServer, gql } from "apollo-server-core";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();
const books = [
  { title: "sdf", author: "author" },
  { title: "sdf2", author: "author2" },
];

const typeDefs = gql`
  type Query {
    getBooks: [Book]
  }

  type Book {
    title: String
    author: String
  }

  type Mutation {
    createBook(input: createBookInput): Book
  }

  type Subscription {
    bookCreated: Book
  }

  input createBookInput {
    title: String!
    author: String!
  }
`;
const resolvers = {
  Query: {
    getBooks: () => books,
  },
  Subscription: {
    bookCreated: {
      subscribe: () => pubsub.asyncIterator(["BOOK_CREATED"]),
    },
  },
  Mutation: {
    createBook: (_: any, { input }: any) => {
      books.push({ ...input });
      pubsub.publish("BOOK_CREATED", { bookCreated: { ...input } });
      return books[books.length - 1];
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();
const httpServer = createServer(app);

const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});
const serverCleanup = useServer(
  {
    schema,
    onConnect: (ctx) => {
      console.log(ctx);
    },
  },
  wsServer
);

const server = new ApolloServer({
  schema,
  csrfPrevention: true,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),

    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

// await connectToDB();

server.start().then(() => {
  server.applyMiddleware({ app, path: "/api" });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(
    `Server is now running on http://localhost:${PORT}${server.graphqlPath}`
  );
});
