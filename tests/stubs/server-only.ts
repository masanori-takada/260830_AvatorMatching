// `server-only`パッケージはimportされただけでエラーを投げる実装になっている(RSCの
// "react-server" export conditionが無い環境では常にindex.jsが使われるため)。
// Vitestはブラウザ向けバンドルではなくNode上でテストを実行するので、このスタブへ
// 差し替えて、サーバー専用モジュールの単体テストが実行できるようにする。
// 実際のクライアントバンドルへの混入検出はビルド(next build)と
// tests/unit/config/client-bundle-server-env.test.tsが担う。
export {};
