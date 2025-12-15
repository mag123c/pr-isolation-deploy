export default function Home() {
  const prNumber = process.env.PR_NUMBER || "main";
  const deployUrl = process.env.DEPLOY_URL || "localhost:3000";
  const buildTime = process.env.BUILD_TIME || new Date().toISOString();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4">
            PR Preview Test
          </h1>
          <p className="text-gray-400 text-lg">
            PR별 격리 환경 테스트용 앱
          </p>
          <div className="mt-4 px-4 py-2 bg-green-600 rounded-lg inline-block">
            Test Branch 3: 초록색 테마
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 space-y-4 border border-gray-700">
          <div className="flex justify-between items-center py-3 border-b border-gray-700">
            <span className="text-gray-400">PR Number</span>
            <span className="text-2xl font-mono font-bold text-blue-400">
              #{prNumber}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 border-b border-gray-700">
            <span className="text-gray-400">Deploy URL</span>
            <span className="font-mono text-green-400">
              {deployUrl}
            </span>
          </div>

          <div className="flex justify-between items-center py-3">
            <span className="text-gray-400">Build Time</span>
            <span className="font-mono text-yellow-400 text-sm">
              {buildTime}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
