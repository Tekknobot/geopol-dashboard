
export default function ErrorState({ message = 'Something went wrong.' }: { message?: string }) {
  return (
    <div className="text-red-600 text-sm">{message}</div>
  )
}
