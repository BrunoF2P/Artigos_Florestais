import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';

const config = {
  preprocess: preprocess({ postcss: true }),

  kit: {
    adapter: adapter({
      fallback: '200.html'
    }),

    paths: {
      base: process.env.NODE_ENV === 'production'
        ? '/Artigos_Florestais'
        : ''
    }
  }
};

export default config;
