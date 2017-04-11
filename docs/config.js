var langs = [
  {title: '简体中文', path: '/zh-Hans/', matchPath: /^\/zh-Hans/}
]

docute.init({
  landing: 'landing.html',
  debug: true,
  repo: 'michalyao/evermonkey',
  twitter: 'Michalix2',
  'edit-link': 'https://github.com/michalyao/evermonkey/master/docs/',
  tocVisibleDepth: 3,
  nav: {
    default: [
      {
        title: 'Home', path: '/home'
      },
      {
        title: 'Changelog', path: '/changelog', source: 'https://raw.githubusercontent.com/michalyao/evermonkey/master/CHANGELOG.md'
      },
      {
        title: 'Languages', type: 'dropdown', items: langs
      }
    ],
    'zh-Hans': [
      {
        title: '首页', path: '/zh-Hans/'
      },
      {
        title: '插件', path: '/zh-Hans/plugins'
      },
      {
        title: '命令行工具', path: '/zh-Hans/cli'
      },
      {
        title: '选择语言', type: 'dropdown', items: langs
      }
    ]
  },
  icons: [
    {
      label: '关注我的微博',
      svgId: 'i-weibo',
      svgClass: 'weibo-icon',
      link: 'http://weibo.com/u/3480069510'
    }
  ],
  plugins: [
    docsearch({
      apiKey: '65360cf9a91d87cd455d2b286d0d89ee',
      indexName: 'evermonkey',
      tags: ['zh-Hans'],
      url: 'http://monkey.yoryor.me'
    }),
    evanyou()
  ]
})
