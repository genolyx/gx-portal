import { StatusPage } from '../../components/ui/StatusPage';

export default function PortalNotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="The page you’re looking for doesn’t exist or has been moved."
    />
  );
}
