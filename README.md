# Style Archive

A web application for managing your wardrobe inventory, planning outfits, and discovering new items to shop for.

## Features

- **Inventory Management**: View and organize your clothing items with photos and metadata
- **AI-Powered Item Analysis**: Automatically extract metadata from item descriptions or image URLs using OpenAI
- **Outfit Planning**: Create and save outfit combinations
- **AI Outfit Suggestions**: Get intelligent outfit recommendations based on your wardrobe using ChatGPT
- **Shopping Recommendations**: Get suggestions for new items that complement your existing wardrobe
- **Add Items**: Easily add new clothing items with details and images

## Setup

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up your OpenAI API key:
   - Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create a `.env.local` file in the root directory
   - Add your API key: `OPENAI_API_KEY=your_api_key_here`

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack

- Next.js 16
- TypeScript
- Tailwind CSS
- OpenAI API
- ESLint
