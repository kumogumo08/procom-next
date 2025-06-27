/** @type {import('tailwindcss').Config} */
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}', // App Router の場合
    './pages/**/*.{js,ts,jsx,tsx,mdx}', // Pages Router の場合 (両方使うなら両方記述)
    './components/**/*.{js,ts,jsx,tsx,mdx}', // components ディレクトリがどこにあるかによる
    './src/components/**/*.{js,ts,jsx,tsx,mdx}', // もし components が src の下にある場合
    // その他の、Tailwind CSS のクラスを使う可能性のあるファイルのパスを全て記述
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

