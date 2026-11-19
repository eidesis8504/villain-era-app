// 자동 생성 파일: scripts/make-splash.py — 손으로 고치지 마세요
// 스플래시 일러스트(와구와구 카드엽서): 화면 크기별 WebP와 흐린 배경용 아주 작은 그림
import goSpace720 from '../assets/splash/go-space-720.webp'
import goSpace1080 from '../assets/splash/go-space-1080.webp'
import goSpace1440 from '../assets/splash/go-space-1440.webp'
import spookyForest720 from '../assets/splash/spooky-forest-720.webp'
import spookyForest1080 from '../assets/splash/spooky-forest-1080.webp'
import spookyForest1440 from '../assets/splash/spooky-forest-1440.webp'
import nightmare720 from '../assets/splash/nightmare-720.webp'
import nightmare1002 from '../assets/splash/nightmare-1002.webp'
import newCaledonia720 from '../assets/splash/new-caledonia-720.webp'
import newCaledonia1080 from '../assets/splash/new-caledonia-1080.webp'
import newCaledonia1440 from '../assets/splash/new-caledonia-1440.webp'
import incursion407 from '../assets/splash/incursion-407.webp'
import breakingBad720 from '../assets/splash/breaking-bad-720.webp'
import breakingBad1080 from '../assets/splash/breaking-bad-1080.webp'

export type SplashSource = { url: string; w: number }
export type SplashArt = { slug: string; ratio: number; sources: SplashSource[]; backdrop: string }

export const SPLASH_ART: SplashArt[] = [
  {
    slug: 'go-space',
    ratio: 0.705,
    sources: [{ url: goSpace720, w: 720 }, { url: goSpace1080, w: 1080 }, { url: goSpace1440, w: 1440 }],
    backdrop: 'data:image/webp;base64,UklGRtQBAABXRUJQVlA4IMgBAACQCACdASoYACIAPtFUpkuoJKOhqqwBABoJbAC7MvqNT0GwhbStk2L8EABKym1cWG4qOvbUo7GgHGu7qHEwcE9erMk3T65+nzqEefb20AD7nRLLwZNA9ieB30Nrw+xndP/HvzBVov80/jvUPvz/VnplffKq9rG0RHyu6Rcspl/YGZTpOWixePOh+mdsbs3HyB01KDr0yVaaXxNUC83G/uKXjpGsUannf4fcsccN6wkO+FssdbepiF7E/Z2TbPH2E1H58YpTVH/zkhdCYuYmHxOpsrpEUZxu5ZblQfwe4zgJpHUVGjREJ/M7YFqwc1+c8uZ2gvQG2O8l1ysPXy8j5ILPwmJPT31VIKlhInGQddW95hHnVmLt4ExAsnR0utT8YG0TlDf770snObrWLZK0ih9H2fwF3L/9+8o6OIYojjm4u7XVYXBMpoqmwfpnIbX5nFodn65jqtQfv0KU8lQr3Ps1f68UNHCb0L3nzF+Pb8bvXywV2/lbxMYO+aapfwOvuLmejHAq+87LNlLxeNMmUvNx8e20+y9V7m5A7EhpvvVxXz0v+YqZGliK51Qn72yYeLYG92zyFQxUbb8fxM21mbC/iZcRy7izAAA=',
  },
  {
    slug: 'spooky-forest',
    ratio: 0.709,
    sources: [{ url: spookyForest720, w: 720 }, { url: spookyForest1080, w: 1080 }, { url: spookyForest1440, w: 1440 }],
    backdrop: 'data:image/webp;base64,UklGRiIBAABXRUJQVlA4IBYBAAAwBwCdASoYACIAPsVUn0unpSKhtVv4APAYiWoAnTKEh8gl4UamVyu9ZQCuRyojz0KkmHic427N87RWVZtB3w+FuEAA/ujMcZRYLg1sx0xgkoRRDvNmb5s7JeuDD+TQ42nP+j0654JH4ojCxD1+pSqPnqWqTclpSuhD7zlhcEjjeERVn18ACzWkk7YxIzsE8MBlv77h7dx236qLwqpksRJTe30obqihT6eNX3A5NxthmSjC6b+tBug6639tKOyf7MP79D2/g6hmwqYo53V+3Z9U9hldj+AoyGb5ximLa+GBB6xoFrvcFbWzBNXn544/gCVAswwcwilQp4mXlKK1A9mLy/SO5Oic3u2q3pQB9P5Tg5/wggAAAA==',
  },
  {
    slug: 'nightmare',
    ratio: 0.7106,
    sources: [{ url: nightmare720, w: 720 }, { url: nightmare1002, w: 1002 }],
    backdrop: 'data:image/webp;base64,UklGRjIBAABXRUJQVlA4ICYBAAAQCACdASoYACIAPtFUp00oJCOiMBVaqQAaCWwAv2uVYO5pmfWVbjgBVQIs4t1hJmt4nLSYu35KKWyAHVCiOwIVCRwddxPVFjb4AP6Di5sRkQvlVek3EQd63HEIRiVGqGmtNv34sXR6tJngtADSljHksz47TkUcMrZk2JP6/beL5NSk1ym2OokZMt6PvSdPxpHHDcMUpFYgBwBUSh3zhHEKhCFk1wa3VKakE/gF3zmkvmD0Me9eKTo4yoPwQeylfjt/a+IAMDYz8c2/ssTG0ECjuotHBWJGEEx/xdYog7gkk0Z6j91aNgefTcNcF9QxotRUmhNNUNoGLlxZ/f1YP9DuLRC2Q0OkKUkDYKWRMBjEgYknMRS1eaMfYOkFs5vdxXQ4lFOjuAA=',
  },
  {
    slug: 'new-caledonia',
    ratio: 0.709,
    sources: [{ url: newCaledonia720, w: 720 }, { url: newCaledonia1080, w: 1080 }, { url: newCaledonia1440, w: 1440 }],
    backdrop: 'data:image/webp;base64,UklGRmQBAABXRUJQVlA4IFgBAABQCACdASoYACIAPtFYqE+oJKOiKrgIAQAaCWwAnTKDPeSjXZLvOhEljGx9k0JpxfRaEMCvinVvtkCVzS7Vbo6TRBR6Forl5AgCtoAA/BETuG/ukybXceKQNCLhW5rs9CA9ky3P6X+eH0koUWcnu3dlz52cC9ubNZyub2HG6epzE821KnSnYu5BIYq/jorB+x+r10DVw4L/J6CO4XhZgBMhg7JdpffSjWCOP16g0o0nNlly86NHbKikbylanrN5fpK0Po1EaIpqNfuuyYl0NIkN297N1TecUyJSMAucKBThM7Fq77RLKdWKg+F4OAhdtzb5EtNQoKZL+6uUNYwivxw17EHMFN22T2lwyzlsH6ihyy9RbF6sgUmOb9mPAfkFytxFhLTz4zEX8wyKyc/H9k//OE3Pbxc+29vDGHHlPI3TVxowYdDbfmIuy2jRFOUhqp8wxjqVBf0AAA==',
  },
  {
    slug: 'incursion',
    ratio: 0.7091,
    sources: [{ url: incursion407, w: 407 }],
    backdrop: 'data:image/webp;base64,UklGRnIBAABXRUJQVlA4IGYBAADwBgCdASoYACIAPtFWpEwoJKOiKqwBABoJQBbfesXoJnIPC9QQGhaC3B47JkRm8wBV/t3ihSNp/UtoiB3oMQEAAP7ricmVijxm2dgEuO1ErBu0K57GsYkacr+Xn3kDPLyuqHYsNu9v0fzB3pX0J5aGsuCQb3aLKbdlyrQ/1Ej61ukfq4kjs3M4hWllreiUaehO7dcWbCF8JnNZPC2nCH2QdsfdzSjrxhhYP7tZBtfHyXvV107ttUrqxKREFujimzwIBLDaBN0St4/IrZI6T4FJdwLbttVbrfth/3bUJeei1gqo8ZaFLQmqQS3PcVKqGs6Hp3Me5IEqB7/jOBYpwwHmpPgg5pmMWPrYYIe5bTs2iHSG23XreJDl/5RfDelJ6bCFsu65e8/xvOT1ku1lE9EKjB59ZTKX4L7o/dP9KJfVYBWnWWtXv5H/EAR6zQONxmOWLnPUsOpGvlq9Vjpf92HicHzAAAAA',
  },
  {
    slug: 'breaking-bad',
    ratio: 0.8,
    sources: [{ url: breakingBad720, w: 720 }, { url: breakingBad1080, w: 1080 }],
    backdrop: 'data:image/webp;base64,UklGRqIBAABXRUJQVlA4IJYBAADQCACdASoYAB4APslQnkunpKKhsAwA8BkJbACdMzQ14LYyCNAYYDzt9MA3lD/Qo9ucBKxW3p8ANVzVcIhDWWjRfZoQuVn6ehGyqMHWIj7gAP4CukQV9Imq/n92KMfOkXzfqt59z9NgUgSpDgNQJ3zgyHKZOcexqHoMWTNcmXapaEsMMjMuSs/lsAkXXa3ivbDfQKzafq5CaztyGtmrbea03z8BpEK3j69sy/rt13Kf/Dopa2gdtKn5DP5jE7j32rpjcsdeqjufwUrd9RaTIHHiidPPlZD6Qn0rtf4AHTHCn2yPODUNPT7KMtDYmE8RAXMf2ZKxnMiYtczdu9wPjOWQYcb16hWO9MZQWWp1pKNVs2MyMdBP3wvm0VmEwyf/2AbODcMnRl6KeAi5yOvROvZjUvwJARA1EOYveouhY92hPdTe+lEVTy7QVvbhHeHK+4dTnn2bV3T57V8ofCrT4TMkozVtSib9kvwiayV0y5H506+bIH6mT/JUAP0nnt3p1r427j5lZEwiS+huOkHJJMzYNxDcDPgA',
  },
]
