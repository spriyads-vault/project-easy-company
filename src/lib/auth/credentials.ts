import { z } from "zod";

// Shared by the login form and the server actions it posts to, so client
// and server validation can never drift apart.
export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type Credentials = z.infer<typeof credentialsSchema>;
