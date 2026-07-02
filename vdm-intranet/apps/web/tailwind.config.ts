import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vdm: {
          orange: '#F28C38',
          'orange-light': '#FBCB97',
          'orange-bg': 'rgba(242,140,56,0.10)',
          gray: '#F4F4F6',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
