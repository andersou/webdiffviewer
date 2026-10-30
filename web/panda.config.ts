import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  presets: ['@pandacss/preset-base'], // own tokens only; preset-panda's palette would ship unused CSS vars
  preflight: true,
  include: ['./src/**/*.{js,jsx}'],
  exclude: ['./src/**/*.test.js'],
  outdir: 'styled-system',
  importMap: 'styled-system', // matches the Vite alias, so extraction finds css()/cva() in every folder
  outExtension: 'js',
  jsxFramework: 'solid',
  theme: {
    extend: {
      breakpoints: { sm: '40rem', md: '48rem', lg: '64rem' },
      // VS Code dark palette for the app chrome
      tokens: {
        colors: {
          ui: {
            bg: { value: '#1e1e1e' },
            panel: { value: '#252526' },
            raised: { value: '#2d2d30' },
            raisedHover: { value: '#37373d' },
            input: { value: '#3c3c3c' },
            hover: { value: '#2a2d2e' },
            selected: { value: '#04395e' },
            border: { value: '#333333' },
            borderStrong: { value: '#555555' },
            fg: { value: '#cccccc' },
            heading: { value: '#bbbbbb' },
            muted: { value: '#888888' },
            faint: { value: '#6e7681' },
            accent: { value: '#007fd4' },
            link: { value: '#4fc1ff' },
            error: { value: '#f48771' },
            add: { value: 'rgba(46, 160, 67, 0.18)' },
            del: { value: 'rgba(248, 81, 73, 0.18)' },
            hunk: { value: '#1f2a36' },
          },
          status: {
            modified: { value: '#e2c08d' },
            added: { value: '#73c991' },
            deleted: { value: '#f14c4c' },
            renamed: { value: '#4fc1ff' },
          },
        },
        fonts: {
          ui: { value: 'system-ui, sans-serif' },
          code: { value: 'ui-monospace, Menlo, monospace' },
        },
      },
    },
  },
  globalCss: {
    'html, body, #root': { h: '100%', m: 0 },
    body: { bg: 'ui.bg', color: 'ui.fg', fontFamily: 'ui', fontSize: '13px' },
    button: { cursor: 'pointer' },
    'button:focus-visible, select:focus-visible': { outline: '1px solid token(colors.ui.accent)', outlineOffset: '-1px' },
    kbd: { fontFamily: 'code', fontSize: '11px', color: '#999', border: '1px solid token(colors.ui.borderStrong)', borderRadius: '3px', px: '4px' },
  },
})
