type UserMessage = {
  id: string;
  role: "USER";
  content: string;
  createdAt: string;
  metadata?: any;
};

export function UserMessage({ message }: { message: UserMessage }) {
  return <div>{message.content}</div>;
}
