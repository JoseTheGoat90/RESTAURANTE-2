/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const N8N_WORKFLOW_TEMPLATE = {
  name: "Restaurante - Asistente Culinario & MCP Tools",
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "panel-chat",
        responseMode: "responseNode",
        options: {}
      },
      id: "webhook-trigger",
      name: "Webhook Panel Chat",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [240, 300],
      webhookId: "panel-chat"
    },
    {
      parameters: {
        promptType: "define",
        text: "={{ $json.body.message }}",
        options: {
          systemMessage: "Eres el asistente inteligente del restaurante «Restaurante · Panel de Gestión», desarrollado como propuesta para la Universidad de Córdoba (Introducción a las Ciencias de Datos).\n\nTienes a tu disposición 4 herramientas obligatorias:\n1. registrar_venta: registra un plato y descuenta los ingredientes de la receta.\n2. registrar_gasto: registra un egreso (ingredientes, servicios, nómina, otros).\n3. consultar_inventario: consulta el stock disponible e informa insumos bajo mínimo.\n4. generar_reporte: calcula ventas, gastos y balance neto verificable.\n\nREGLA ESTRICTA: Los cálculos matemáticos deben provenir de las herramientas, nunca inventes cifras."
        }
      },
      id: "ai-agent",
      name: "AI Agent (LangChain)",
      type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: 1.7,
      position: [520, 300]
    },
    {
      parameters: {
        model: "gemini-2.5-flash",
        options: {
          temperature: 0.2
        }
      },
      id: "google-gemini-chat",
      name: "Google Gemini Chat Model",
      type: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
      typeVersion: 1,
      position: [520, 520]
    },
    {
      parameters: {
        sessionId: "={{ $json.body.sessionId || 'default-session' }}"
      },
      id: "memory-buffer",
      name: "Window Buffer Memory",
      type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
      typeVersion: 1.3,
      position: [680, 520]
    },
    {
      parameters: {
        name: "consultar_inventario",
        description: "Consulta el inventario de ingredientes del restaurante, existencias actuales y qué insumos están bajo el mínimo.",
        workflowId: {
          __rl: true,
          value: "",
          mode: "list"
        }
      },
      id: "tool-consultar-inventario",
      name: "Tool: consultar_inventario",
      type: "@n8n/n8n-nodes-langchain.toolCustom",
      typeVersion: 1.1,
      position: [400, 100]
    },
    {
      parameters: {
        name: "generar_reporte",
        description: "Genera el reporte financiero con total de ventas, total de gastos y balance neto del día o periodo.",
        workflowId: {
          __rl: true,
          value: "",
          mode: "list"
        }
      },
      id: "tool-generar-reporte",
      name: "Tool: generar_reporte",
      type: "@n8n/n8n-nodes-langchain.toolCustom",
      typeVersion: 1.1,
      position: [580, 100]
    },
    {
      parameters: {
        name: "registrar_venta",
        description: "Registra una venta de un plato y cantidad en el restaurante, descontando ingredientes.",
        workflowId: {
          __rl: true,
          value: "",
          mode: "list"
        }
      },
      id: "tool-registrar-venta",
      name: "Tool: registrar_venta",
      type: "@n8n/n8n-nodes-langchain.toolCustom",
      typeVersion: 1.1,
      position: [760, 100]
    },
    {
      parameters: {
        name: "registrar_gasto",
        description: "Registra un gasto operativo del restaurante clasificado en ingredientes, servicios, nómina u otros.",
        workflowId: {
          __rl: true,
          value: "",
          mode: "list"
        }
      },
      id: "tool-registrar-gasto",
      name: "Tool: registrar_gasto",
      type: "@n8n/n8n-nodes-langchain.toolCustom",
      typeVersion: 1.1,
      position: [940, 100]
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: "={\n  \"output\": {{ JSON.stringify($json.output) }}\n}",
        options: {}
      },
      id: "respond-webhook",
      name: "Respond to Webhook",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [820, 300]
    }
  ],
  connections: {
    "Webhook Panel Chat": {
      main: [
        [
          {
            node: "AI Agent (LangChain)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "AI Agent (LangChain)": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Google Gemini Chat Model": {
      ai_languageModel: [
        [
          {
            node: "AI Agent (LangChain)",
            type: "ai_languageModel",
            index: 0
          }
        ]
      ]
    },
    "Window Buffer Memory": {
      ai_memory: [
        [
          {
            node: "AI Agent (LangChain)",
            type: "ai_memory",
            index: 0
          }
        ]
      ]
    },
    "Tool: consultar_inventario": {
      ai_tool: [
        [
          {
            node: "AI Agent (LangChain)",
            type: "ai_tool",
            index: 0
          }
        ]
      ]
    },
    "Tool: generar_reporte": {
      ai_tool: [
        [
          {
            node: "AI Agent (LangChain)",
            type: "ai_tool",
            index: 0
          }
        ]
      ]
    },
    "Tool: registrar_venta": {
      ai_tool: [
        [
          {
            node: "AI Agent (LangChain)",
            type: "ai_tool",
            index: 0
          }
        ]
      ]
    },
    "Tool: registrar_gasto": {
      ai_tool: [
        [
          {
            node: "AI Agent (LangChain)",
            type: "ai_tool",
            index: 0
          }
        ]
      ]
    }
  }
};
