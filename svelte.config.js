import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: preprocess({ postcss: true }),
  kit: {
    adapter: adapter({
      fallback: '200.html'
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/scopus-base-manager' : ''
    }
  }
};

export default config;
