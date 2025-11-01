import { createClient } from '@supabase/supabase-js';
import { ChatbotDataProvider } from '../src/services/chatbotDataProvider';

// Create Supabase client for scripts
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function testChatbot() {
  const chatbot = new ChatbotDataProvider();

  const testQueries = [
    "Is bus DL001 delayed?",
    "What's the peak hour on Route Central Delhi Loop on Wednesdays?",
    "Which buses are currently delayed?",
    "Is bus DL002 taking more time than usual?",
    "How many bus stops are there for DL001?",
    "Show me historical performance for DL001",
    "What are the performance trends for DL001?",
    "Analyze Route Central Delhi Loop trends",
    "Show me overall fleet status"
  ];

  console.log('🤖 Testing chatbot queries...\n');

  for (const query of testQueries) {
    console.log(`❓ Query: "${query}"`);
    try {
      const response = await chatbot.handleQuery(query);
      console.log(`💬 Response: ${JSON.stringify(response, null, 2)}\n`);
    } catch (error) {
      console.log(`❌ Error: ${error}\n`);
    }
  }

  console.log('✅ Chatbot testing complete!');
}

// Run tests
testChatbot();
