// Example TypeScript file to demonstrate tooling
export interface User {
  id: number;
  name: string;
  email: string;
}

export function greetUser(user: User): string {
  return `Hello, ${user.name}!`;
}

// Example usage
const exampleUser: User = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
};

console.log(greetUser(exampleUser));
