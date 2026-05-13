import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="min-h-[calc(100vh-52px)] flex items-center justify-center py-12 px-4">
      <SignIn />
    </main>
  )
}
