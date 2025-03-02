export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600"></div>
      <p className="mt-4 text-gray-600 font-medium">Wait langgg...</p>
    </div>
  );
}