/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      "colors": {
              "inverse-surface": "#e3e2e2",
              "on-tertiary-fixed": "#1c1b1b",
              "surface-container": "#1e2020",
              "on-tertiary-container": "#464544",
              "surface-dim": "#121414",
              "outline": "#99907c",
              "background": "#121414",
              "on-primary-container": "#554300",
              "primary-container": "#d4af37",
              "error": "#ffb4ab",
              "on-error": "#690005",
              "on-primary": "#3c2f00",
              "surface-bright": "#383939",
              "surface-container-high": "#292a2a",
              "tertiary": "#d1cecd",
              "surface-container-low": "#1a1c1c",
              "primary": "#f2ca50",
              "outline-variant": "#4d4635",
              "on-primary-fixed": "#241a00",
              "surface-container-highest": "#343535",
              "surface-tint": "#e9c349",
              "secondary": "#c8c6c2",
              "on-tertiary": "#313030",
              "surface-variant": "#343535",
              "secondary-fixed-dim": "#c8c6c2",
              "on-error-container": "#ffdad6",
              "inverse-primary": "#735c00",
              "tertiary-fixed": "#e5e2e1",
              "error-container": "#93000a",
              "surface-container-lowest": "#0d0e0f",
              "on-surface-variant": "#d0c5af",
              "secondary-container": "#494946",
              "inverse-on-surface": "#2f3131",
              "on-surface": "#e3e2e2",
              "on-secondary-fixed-variant": "#474744",
              "on-primary-fixed-variant": "#574500",
              "tertiary-fixed-dim": "#c9c6c5",
              "primary-fixed-dim": "#e9c349",
              "on-secondary-fixed": "#1b1c19",
              "secondary-fixed": "#e4e2dd",
              "on-tertiary-fixed-variant": "#474646",
              "on-secondary-container": "#b9b8b4",
              "on-secondary": "#30312e",
              "primary-fixed": "#ffe088",
              "tertiary-container": "#b5b2b2",
              "on-background": "#e3e2e2",
              "surface": "#121414"
      },
      "borderRadius": {
              "DEFAULT": "0.125rem",
              "lg": "0.25rem",
              "xl": "0.5rem",
              "full": "0.75rem"
      },
      "spacing": {
              "sm": "12px",
              "xxl": "48px",
              "giant": "96px",
              "huge": "64px",
              "md": "16px",
              "lg": "24px",
              "xs": "8px",
              "xl": "32px",
              "xxs": "4px"
      },
      "fontFamily": {
              "headline-xl-mobile": [
                      "Literata", "serif"
              ],
              "headline-lg": [
                      "Literata", "serif"
              ],
              "headline-md": [
                      "Literata", "serif"
              ],
              "body-md": [
                      "Hanken Grotesk", "sans-serif"
              ],
              "body-sm": [
                      "Hanken Grotesk", "sans-serif"
              ],
              "headline-xl": [
                      "Literata", "serif"
              ],
              "body-lg": [
                      "Hanken Grotesk", "sans-serif"
              ],
              "display-lg": [
                      "Literata", "serif"
              ],
              "label-caps": [
                      "Hanken Grotesk", "sans-serif"
              ]
      },
      "fontSize": {
              "headline-xl-mobile": [
                      "28px",
                      {
                              "lineHeight": "1.2",
                              "fontWeight": "500"
                      }
              ],
              "headline-lg": [
                      "24px",
                      {
                              "lineHeight": "1.3",
                              "fontWeight": "500"
                      }
              ],
              "headline-md": [
                      "20px",
                      {
                              "lineHeight": "1.4",
                              "fontWeight": "500"
                      }
              ],
              "body-md": [
                      "16px",
                      {
                              "lineHeight": "1.6",
                              "fontWeight": "400"
                      }
              ],
              "body-sm": [
                      "14px",
                      {
                              "lineHeight": "1.5",
                              "fontWeight": "400"
                      }
              ],
              "headline-xl": [
                      "32px",
                      {
                              "lineHeight": "1.2",
                              "fontWeight": "500"
                      }
              ],
              "body-lg": [
                      "18px",
                      {
                              "lineHeight": "1.6",
                              "fontWeight": "400"
                      }
              ],
              "display-lg": [
                      "48px",
                      {
                              "lineHeight": "1.1",
                              "letterSpacing": "-0.02em",
                              "fontWeight": "600"
                      }
              ],
              "label-caps": [
                      "12px",
                      {
                              "lineHeight": "1.2",
                              "letterSpacing": "0.1em",
                              "fontWeight": "600"
                      }
              ]
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
