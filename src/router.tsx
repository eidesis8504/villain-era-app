import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router'
import { Root } from './app/Root'
import { AppShell } from './app/Shell'
import AnimalDetailPage from './pages/AnimalDetailPage'
import AnimalFormPage from './pages/AnimalFormPage'
import AnimalsPage from './pages/AnimalsPage'
import HomePage from './pages/HomePage'
import { AlertsPage, NoticesPage, NotFound } from './pages/InfoPages'
import MorePage from './pages/MorePage'
import { Spinner } from './ui/kit'

// 자주 쓰지 않는 화면은 필요할 때 불러온다 (첫 화면 용량 줄이기)
const named = <T extends Record<string, unknown>>(load: () => Promise<T>, key: keyof T) =>
  lazy(() => load().then((m) => ({ default: m[key] as ComponentType })))
const ClutchPage = named(() => import('./pages/ClutchPages'), 'ClutchPage')
const ClutchFemalePage = named(() => import('./pages/ClutchPages'), 'ClutchFemalePage')
const CommunityPage = named(() => import('./pages/CommunityPages'), 'CommunityPage')
const PostPage = named(() => import('./pages/CommunityPages'), 'PostPage')
const WritePage = named(() => import('./pages/CommunityPages'), 'WritePage')
const LineageHubPage = named(() => import('./pages/LineagePages'), 'LineageHubPage')
const LineagePage = named(() => import('./pages/LineagePages'), 'LineagePage')
const QrPage = named(() => import('./pages/QrPages'), 'QrPage')
const AnimalByCode = named(() => import('./pages/QrPages'), 'AnimalByCode')
const WeightPage = named(() => import('./pages/WeightPages'), 'WeightPage')
const WeightAllPage = named(() => import('./pages/WeightPages'), 'WeightAllPage')
const TodoPage = lazy(() => import('./pages/TodoPage'))
const TransferClaimPage = lazy(() => import('./pages/TransferClaimPage'))
const BlockedPage = lazy(() => import('./pages/BlockedPage'))
const FeedingListPage = named(() => import('./pages/FeedingPages'), 'FeedingListPage')
const FeedingBulkPage = named(() => import('./pages/FeedingPages'), 'FeedingBulkPage')
const HealthPage = named(() => import('./pages/HealthPages'), 'HealthPage')
const ConsultPage = named(() => import('./pages/HealthPages'), 'ConsultPage')
const AdminPage = lazy(() => import('./pages/AdminPage'))
const ProductPage = lazy(() => import('./pages/ProductPage'))
// 카메라 QR 인식 라이브러리는 스캔 화면에서만 불러온다
const ScanPage = lazy(() => import('./pages/ScanPage'))
// 약관·정책·지원 페이지는 계정 없이 열린다 (앱 화면 밖 라우트)
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/legal/TermsPage'))
const PolicyPage = lazy(() => import('./pages/legal/PolicyPage'))
const SupportPage = lazy(() => import('./pages/legal/SupportPage'))
const wait = (el: ReactNode) => <Suspense fallback={<Spinner center />}>{el}</Suspense>

export const router = createBrowserRouter([
  { path: 'privacy', element: wait(<PrivacyPage />) },
  { path: 'terms', element: wait(<TermsPage />) },
  { path: 'policy', element: wait(<PolicyPage />) },
  { path: 'support', element: wait(<SupportPage />) },
  {
    element: <Root />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'todo', element: wait(<TodoPage />) },
          { path: 'animals', element: <AnimalsPage /> },
          { path: 'animals/new', element: <AnimalFormPage /> },
          { path: 'animals/:id', element: <AnimalDetailPage /> },
          { path: 'animals/:id/edit', element: <AnimalFormPage /> },
          { path: 'animals/:id/weight', element: wait(<WeightPage />) },
          { path: 'animals/:id/feeding', element: wait(<FeedingListPage />) },
          { path: 'feedings', element: wait(<FeedingBulkPage />) },
          { path: 'animals/:id/health', element: wait(<HealthPage />) },
          { path: 'animals/:id/consult', element: wait(<ConsultPage />) },
          { path: 'animals/:id/lineage', element: wait(<LineagePage />) },
          { path: 'animals/:id/qr', element: wait(<QrPage />) },
          { path: 'a/:code', element: wait(<AnimalByCode />) },
          { path: 'weights', element: wait(<WeightAllPage />) },
          { path: 'lineage', element: wait(<LineageHubPage />) },
          { path: 'clutch', element: wait(<ClutchPage />) },
          { path: 'clutch/:id', element: wait(<ClutchFemalePage />) },
          { path: 'scan', element: wait(<ScanPage />) },
          { path: 'community', element: wait(<CommunityPage />) },
          { path: 'community/new', element: wait(<WritePage />) },
          { path: 'community/:id', element: wait(<PostPage />) },
          { path: 'more', element: <MorePage /> },
          { path: 'blocked', element: wait(<BlockedPage />) },
          { path: 'admin', element: wait(<AdminPage />) },
          { path: 'notices', element: <NoticesPage /> },
          { path: 'alerts', element: <AlertsPage /> },
          { path: 'transfer', element: wait(<TransferClaimPage />) },
          { path: 'p/:slug', element: wait(<ProductPage />) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
