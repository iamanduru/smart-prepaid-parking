import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Smart Prepaid Parking API",
      version: "1.0.0",
      description:
        "API documentation for the Smart Prepaid Parking Management System.",
    },

    servers: [
      {
        url: "http://localhost:4000",
        description: "Local development server",
      },
    ],

    components: {
      securitySchemes: {
        /*
         * Used by Vehicle Owners and
         * Parking Administrators.
         *
         * Header:
         * Authorization: Bearer <JWT>
         */
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },

        /*
         * Used by authenticated physical
         * parking scanner/gate devices.
         *
         * Header:
         * X-Scanner-Key: <scanner API key>
         */
        scannerAuth: {
          type: "apiKey",
          in: "header",
          name: "X-Scanner-Key",
          description:
            "Scanner device API key used by an authorized parking gate device.",
        },
      },

      schemas: {
        RegisterRequest: {
          type: "object",

          required: [
            "name",
            "email",
            "password",
          ],

          properties: {
            name: {
              type: "string",
              example: "Jane Doe",
            },

            email: {
              type: "string",
              format: "email",
              example: "jane@example.com",
            },

            phone: {
              type: "string",
              nullable: true,
              example: "0788000000",
            },

            password: {
              type: "string",
              format: "password",
              example: "SecurePass123",
            },
          },
        },

        LoginRequest: {
          type: "object",

          required: [
            "email",
            "password",
          ],

          properties: {
            email: {
              type: "string",
              format: "email",
              example: "jane@example.com",
            },

            password: {
              type: "string",
              format: "password",
              example: "SecurePass123",
            },
          },
        },

        User: {
          type: "object",

          properties: {
            id: {
              type: "string",
              format: "uuid",
            },

            name: {
              type: "string",
            },

            email: {
              type: "string",
              format: "email",
            },

            phone: {
              type: "string",
              nullable: true,
            },

            role: {
              type: "string",

              enum: [
                "VEHICLE_OWNER",
                "ADMINISTRATOR",
              ],
            },

            createdAt: {
              type: "string",
              format: "date-time",
            },

            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },

        ErrorResponse: {
          type: "object",

          properties: {
            success: {
              type: "boolean",
              example: false,
            },

            message: {
              type: "string",
              example:
                "An error occurred",
            },
          },
        },
      },
    },
  },

  /*
   * Swagger reads the JSDoc/OpenAPI blocks
   * from all route files.
   */
  apis: [
    "./src/routes/*.ts",
  ],
};

export const swaggerSpec =
  swaggerJsdoc(options);