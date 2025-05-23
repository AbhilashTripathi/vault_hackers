# BlockfestChatBot - Blockchain RAG Assistant

A specialized chatbot for blockchain and cryptocurrency information that uses Retrieval-Augmented Generation (RAG) with Google's Gemini API to provide accurate and contextual responses based on a knowledge base of blockchain documents.

## Features

- RAG system powered by Google's Gemini AI model
- Loads multiple document files (.txt and .mdx) from the data directory
- Interactive chat interface with source attribution
- Document management interface to view and add new knowledge documents
- Clean, responsive design for desktop and mobile use
- Robust error handling and rate-limiting protection

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Google Gemini API key

## Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd BlockfestChatBot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   PORT=3001
   ```

4. Start the server:
   ```
   npm start
   ```

   For development with auto-restart:
   ```
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

### Chat Interface

1. Navigate to the "Chat" tab
2. Type your message in the input field
3. Press Enter or click the send button
4. View the AI's response in the chat window

### Document Management

1. Navigate to the "Documents" tab
2. View statistics about the loaded documents
3. Browse the list of available documents
4. Add new documents to the knowledge base:
   - Enter a title
   - Select file type (Text or Markdown)
   - Enter the document content
   - Click "Add Document"

The system will automatically reload the knowledge base to include your new document.

### RAG System Features

This chatbot uses a Retrieval-Augmented Generation (RAG) system that:
- Loads all document files from the data directory
- Splits documents into chunks for efficient retrieval
- Creates vector embeddings for semantic search
- Retrieves relevant context based on user queries
- Provides source attribution for responses

### Supported Document Types

The system supports two types of document files:
- Text files (.txt) - Plain text documents
- Markdown files (.mdx) - Markdown documents with extended features

## API Endpoints

### Chat

- **POST /api/chat**
  - Request body: `{ "message": "Your message here" }`
  - Response: `{ "response": "AI response", "usage": { ... } }`

### Fine-Tuning (Not Available)

The fine-tuning endpoints return a 501 Not Implemented status as this functionality is not available with the Gemini API in the current version.

## Getting a Gemini API Key

To use this application, you'll need a Google Gemini API key:

1. Visit the [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key and add it to your `.env` file

## Security Considerations

- The Gemini API key is stored in the `.env` file, which should never be committed to version control
- The server includes CORS protection to prevent unauthorized access
- Error handling is implemented to prevent sensitive information leakage

## License

[MIT License](LICENSE)