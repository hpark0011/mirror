import { createHashRouter } from 'react-router-dom'
import { App } from './App'
import { DocumentList } from './routes/document-list'
import { DocumentView } from './routes/document-view'

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <DocumentList />,
      },
      {
        path: 'document/:name',
        element: <DocumentView />,
      },
    ],
  },
])
