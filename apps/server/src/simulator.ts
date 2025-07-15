const RESPONSE = `Quis voluptate mollit nulla labore quis irure irure reprehenderit esse sunt. Reprehenderit non officia nisi aliqua id do proident Lorem pariatur tempor eiusmod reprehenderit nulla sit. Fugiat Lorem reprehenderit reprehenderit. Quis proident dolor amet pariatur dolor culpa Lorem minim occaecat aute. Nisi dolore adipisicing minim dolore sunt. Incididunt deserunt voluptate in irure quis. Sit duis irure laboris est occaecat mollit est.

Elit esse officia est veniam quis. Anim minim eiusmod irure laboris laboris dolore ea duis enim aliqua amet proident do. Ea incididunt voluptate ut in mollit ipsum commodo ipsum esse dolor anim adipisicing officia. Eu anim ullamco veniam elit velit officia consequat aliquip excepteur fugiat aliquip sint in dolore. Tempor do laboris proident sint.`;

export async function* simulateOpenAIStream(): AsyncGenerator<string> {
  const chatCompletionId = `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const model = "gpt-4o";

  // Split response into word chunks for realistic streaming
  const words = RESPONSE.split(" ");

  for (let i = 0; i < words.length; i++) {
    const isLast = i === words.length - 1;
    const content = i === 0 ? words[i] : ` ${words[i]}`;

    const chunk = {
      id: chatCompletionId,
      object: "chat.completion.chunk",
      created: timestamp,
      model: model,
      choices: [
        {
          index: 0,
          delta: {
            content: content,
          },
          finish_reason: null,
        },
      ],
    };

    yield `data: ${JSON.stringify(chunk)}\n\n`;

    // Add realistic delay between chunks
    await new Promise((resolve) =>
      setTimeout(resolve, 20 + Math.random() * 30)
    );
  }

  // Send final chunk with finish_reason
  const finalChunk = {
    id: chatCompletionId,
    object: "chat.completion.chunk",
    created: timestamp,
    model: model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  };

  yield `data: ${JSON.stringify(finalChunk)}\n\n`;
  yield `data: [DONE]\n\n`;
}
