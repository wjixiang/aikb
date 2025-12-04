import Link from 'next/link';

export default function WikiHomePage() {
  return (
    <div className="wiki-home">
      <h1 className="text-3xl font-bold mb-6">使用手册</h1>
      <p className="mb-4">这是一个使用双链笔记构建的Wiki应用。</p>
      <p className="mb-4">请从左侧导航检索文章，或者浏览以下课本目录：</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <div className="p-4 border rounded-lg hover:shadow-md">
          <h3 className="text-xl font-semibold mb-2">内科学</h3>
          {/* <p>这是第一篇文章的简介...</p> */}
          <Link
            href="/wiki/内科学"
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            阅读更多 →
          </Link>
        </div>
        <div className="p-4 border rounded-lg hover:shadow-md">
          <h3 className="text-xl font-semibold mb-2">外科学</h3>
          <p></p>
          <Link
            href="/wiki/外科学"
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            阅读更多 →
          </Link>
        </div>
      </div>
    </div>
  );
}
