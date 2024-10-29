// Import libraries
import OpenAI from 'openai';

// Get the API key from the environment variable
const openai_client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

// Get the cli arguments
const args = process.argv.slice(2);

// Helper function to parse arguments
function parseArgs(args) {
    const params = {};
    args.forEach(arg => {
        const [key, value] = arg.split('=');
        params[key] = value;
    });
    return params;
}

// Parse the arguments
const options = parseArgs(args);

// Function to send a prompt and get the response
async function getChatGPTResponse() {
    if (options['-m'] === undefined) {
        console.warn("No prompt provided.");
        return;
    }
    try {
        const response = await openai_client.chat.completions.create({
            messages: [{ role: 'user', content: options['-m'] }],
            model: 'gpt-3.5-turbo',
        });
        return response;
    } catch (error) {
        console.error("Error with OpenAI API request:", error);
    }
}

// Get the response and print
getChatGPTResponse().then(response => {
    console.log(response.choices[0].message.content)
})
