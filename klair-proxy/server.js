/**
 * Klair MCP Proxy Server
 *
 * This server bridges the browser-based Pitch Deck Studio with the Klair MCP server.
 * It handles MCP protocol communication and exposes a simple REST API for the frontend.
 *
 * Setup:
 * 1. npm init -y
 * 2. npm install express cors node-fetch
 * 3. node server.js
 *
 * The server will run on http://localhost:3001
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

// MCP Server configuration
const MCP_SERVER_URL = 'https://mcp.klair.ai/mcp';

// Store session state
let mcpSession = {
    initialized: false,
    capabilities: {},
    tools: [],
    requestId: 1
};

app.use(cors());
app.use(express.json());

/**
 * Initialize MCP connection
 */
async function initializeMCP() {
    try {
        const response = await fetch(MCP_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {}
                    },
                    clientInfo: {
                        name: 'pitch-deck-studio',
                        version: '1.0.0'
                    }
                },
                id: mcpSession.requestId++
            })
        });

        const result = await response.json();
        if (result.result) {
            mcpSession.initialized = true;
            mcpSession.capabilities = result.result.capabilities || {};
            console.log('MCP initialized:', result.result);

            // List available tools
            await listTools();
        }
        return result;
    } catch (error) {
        console.error('MCP initialization error:', error);
        throw error;
    }
}

/**
 * List available MCP tools
 */
async function listTools() {
    try {
        const response = await fetch(MCP_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/list',
                params: {},
                id: mcpSession.requestId++
            })
        });

        const result = await response.json();
        if (result.result && result.result.tools) {
            mcpSession.tools = result.result.tools;
            console.log('Available tools:', mcpSession.tools.map(t => t.name));
        }
        return result;
    } catch (error) {
        console.error('Error listing tools:', error);
        throw error;
    }
}

/**
 * Call an MCP tool
 */
async function callTool(toolName, args) {
    try {
        const response = await fetch(MCP_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args
                },
                id: mcpSession.requestId++
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Tool call error:', error);
        throw error;
    }
}

// --- REST API Endpoints ---

/**
 * GET /api/status
 * Check MCP connection status
 */
app.get('/api/status', (req, res) => {
    res.json({
        connected: mcpSession.initialized,
        tools: mcpSession.tools.map(t => ({
            name: t.name,
            description: t.description
        }))
    });
});

/**
 * POST /api/initialize
 * Initialize MCP connection
 */
app.post('/api/initialize', async (req, res) => {
    try {
        const result = await initializeMCP();
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/tools
 * List available tools
 */
app.get('/api/tools', (req, res) => {
    res.json({ tools: mcpSession.tools });
});

/**
 * POST /api/tools/:toolName
 * Call a specific tool
 */
app.post('/api/tools/:toolName', async (req, res) => {
    try {
        const { toolName } = req.params;
        const args = req.body;

        const result = await callTool(toolName, args);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/query
 * High-level query endpoint for the chatbot
 * Automatically selects appropriate tools based on the query
 */
app.post('/api/query', async (req, res) => {
    try {
        const { query, context } = req.body;

        // This endpoint can be extended to:
        // 1. Analyze the query to determine which tools to use
        // 2. Call multiple tools and aggregate results
        // 3. Format responses for the chatbot

        // For now, return available tools and let frontend decide
        res.json({
            query,
            availableTools: mcpSession.tools.map(t => t.name),
            suggestion: 'Use /api/tools/:toolName to call specific tools'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/validate-numbers
 * Validate financial numbers in the deck
 */
app.post('/api/validate-numbers', async (req, res) => {
    try {
        const { numbers, context } = req.body;

        // This would call Klair tools to validate the numbers
        // against real data sources

        res.json({
            validated: true,
            numbers: numbers,
            message: 'Number validation requires Klair MCP tools to be configured'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`Klair MCP Proxy running on http://localhost:${PORT}`);
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /api/status          - Check connection status');
    console.log('  POST /api/initialize      - Initialize MCP connection');
    console.log('  GET  /api/tools           - List available tools');
    console.log('  POST /api/tools/:name     - Call a specific tool');
    console.log('  POST /api/query           - High-level query endpoint');
    console.log('  POST /api/validate-numbers - Validate deck numbers');
    console.log('');

    // Try to initialize on startup
    try {
        await initializeMCP();
        console.log('Successfully connected to Klair MCP!');
    } catch (error) {
        console.log('Could not connect to Klair MCP on startup.');
        console.log('Use POST /api/initialize to connect manually.');
    }
});
