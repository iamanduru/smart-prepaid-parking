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
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
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
              example: "Test Driver",
            },
            email: {
              type: "string",
              format: "email",
              example: "driver1@example.com",
            },
            phone: {
              type: "string",
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
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "driver1@example.com",
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
            },
          },
        },
      },
    },
  },

  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec =
  swaggerJsdoc(options);