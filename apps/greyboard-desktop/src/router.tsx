import { createHashRouter } from 'react-router-dom'
import { App } from './App'
import { TaskWorkspaceRoute } from './routes/task-workspace'

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <TaskWorkspaceRoute />,
      },
    ],
  },
])
