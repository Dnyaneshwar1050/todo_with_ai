import { get } from 'node:http';
import {db} from './db/index.js';
import {todosTable} from './db/schema.js';
import{ ilike } from 'drizzle-orm';
import { eq } from "drizzle-orm";
import OpenAi from 'openai';
import readlineSync from 'readline-sync';

const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});


export async function getTodos() {
  return await db.select().from(todosTable);
}

export async function createTodo(todo) {
  const [result] = await db.insert(todosTable).values({todo}).returning({id:todosTable.id,});
  return result.id;
}

export async function updateTodo(id, todo) {
  await db.update(todosTable).set({todo,}).where(eq(todosTable.id, id));
}

export async function deleteTodo(id) {
  await db.delete(todosTable).where(eq(todosTable.id, id));
} 

export async function searchTodos(search) {
  return await db.select().from(todosTable).where(ilike(todosTable.todo, search));
}


const tools = {
    getTodos: getTodos,
    createTodo: createTodo,
    updateTodo: updateTodo,
    deleteTodo: deleteTodo,
    searchTodos: searchTodos
}

const SYSTEM_PROMPT = `You are a helpful assistant that helps users manage their todo list. You can create, update, delete, and search for todos. You can also provide suggestions for new todos based on the user's input.

You can manage task by adding, updating, deleting, and searching for todos in the database. You can also provide suggestions for new todos based on the user's input.
You must strictly follow the follow json format.    


Todo DB Schema:
- id: int and primary key
- todo: string
- created_at: Date Time
- updated_at: Date Time


Available Tools:
- createTodo(title: string): Creates a new todo in the database as string and rturn id of the created todo.
- updateTodo(id: number, title: string): Updates the title of the todo with the given id.
- deleteTodo(id: number): Deletes the todo with the given id.
- searchTodos(search: string): Searches for todos that match the given search query.


Example Conversation:
{"type": "user", "user":"Add a task to buy groceries"}
{"type": "plan", "plan": "i will try to get more context on whats user need to shop"}
{"type": "output", "output": "What do you need to buy?"}
{"type": "user", "user":"I need to buy milk, bread, and eggs"}
{"type": "plan", "plan": "i will use createtodo to create todo in DB"}}
{"type": "action", "function": "createTodo", "input": "shoping for milk, bread, and eggs"}
{"type": "observation ", "observation": "2"}
{"type": "output", "output": "your todo has been created successfully "}}

`;


const message = [{role: 'system', content: SYSTEM_PROMPT}];


while (true) {
    const query = readlineSync.question('User: ');
    const userMessage = {role: 'user', user: query,};
    message.push({role: 'user', content: JSON.stringify(userMessage)});

    while (true) {
        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: message,
            response_format: {
                type: 'json_object',
            },
        });
        const responseMessage = response.choices[0].message;
        message.push(responseMessage);

        const action = JSON.parse(responseMessage.content);

        if (action.type === 'output') {
            console.log('🤖', action.output);
            break;
        } else if (action.type === "action") {
            const fn = tools[action.function];
            if (!fn) throw new Error("invalid tool call");

            const observation = await fn(action.input);

            message.push({
                role: "user",
                content: JSON.stringify({
                type: "observation",
                observation,
                }),
            });
        }
    }
}