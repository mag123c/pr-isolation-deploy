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
          <div className="mt-4 px-4 py-2 bg-blue-600 rounded-lg inline-block">
            Feature A: 새로운 버튼 추가!
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

        <div className="bg-blue-900/30 rounded-xl p-6 border border-blue-800">
          <h2 className="text-xl font-semibold mb-3">테스트 방법</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>PR 생성 후 <code className="bg-gray-700 px-2 py-1 rounded">preview</code> 라벨 추가</li>
            <li>GitHub Actions가 자동으로 환경 생성</li>
            <li>PR 코멘트에 달린 URL로 접속</li>
            <li>위 PR Number가 해당 PR 번호와 일치하는지 확인</li>
          </ol>
        </div>

        <div className="text-center text-gray-500 text-sm">
          <p>이 환경은 PR이 닫히면 자동으로 삭제됩니다.</p>
        </div>
      </div>
    </main>
  );
}
