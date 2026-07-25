import { StatusPage } from '../components/ui/StatusPage';

export default function NotFound() {
  return (
    <StatusPage
      fullScreen
      code="404"
      title="Page not found"
      description="The page you’re looking for doesn’t exist or has been moved."
    />
  );
}
