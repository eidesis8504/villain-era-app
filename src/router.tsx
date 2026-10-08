import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router'
import { Root } from './app/Root'
import { AppShell } from './app/Shell'
import AnimalDetailPage from './pages/AnimalDetailPage'
import AnimalFormPage from './pages/AnimalFormPage'
import AnimalsPage from './pages/AnimalsPage'
import { ClutchFemalePage, ClutchPage } from './pages/ClutchPages'
import { CommunityPage, PostPage, WritePage } from './pages/CommunityPages'
import HomePage from './pages/HomePage'
import { AlertsPage, NoticesPage, NotFound } from './pages/InfoPages'
import { LineageHubPage, LineagePage } from './pages/LineagePages'
import MorePage from './pages/MorePage'
import { AnimalByCode, QrPage } from './pages/QrPages'
import TodoPage from './pages/TodoPage'
import TransferClaimPage from './pages/TransferClaimPage'
import { WeightAllPage, WeightPage } from './pages/WeightPages'
import { Spinner } from './ui/kit'

// 카메라 QR 인식 라이브러리는 스캔 화면에서만 불러온다
const ScanPage = lazy(() => import('./pages/ScanPage'))
const wait = (el: ReactNode) => <Suspense fallback={<Spinner center />}>{el}</Suspense>

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'todo', element: <TodoPage /> },
          { path: 'animals', element: <AnimalsPage /> },
          { path: 'animals/new', element: <AnimalFormPage /> },
          { path: 'animals/:id', element: <AnimalDetailPage /> },
          { path: 'animals/:id/edit', element: <AnimalFormPage /> },
          { path: 'animals/:id/weight', element: <WeightPage /> },
          { path: 'animals/:id/lineage', element: <LineagePage /> },
          { path: 'animals/:id/qr', element: <QrPage /> },
          { path: 'a/:code', element: <AnimalByCode /> },
          { path: 'weights', element: <WeightAllPage /> },
          { path: 'lineage', element: <LineageHubPage /> },
          { path: 'clutch', element: <ClutchPage /> },
          { path: 'clutch/:id', element: <ClutchFemalePage /> },
          { path: 'scan', element: wait(<ScanPage />) },
          { path: 'community', element: <CommunityPage /> },
          { path: 'community/new', element: <WritePage /> },
          { path: 'community/:id', element: <PostPage /> },
          { path: 'more', element: <MorePage /> },
          { path: 'notices', element: <NoticesPage /> },
          { path: 'alerts', element: <AlertsPage /> },
          { path: 'transfer', element: <TransferClaimPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
