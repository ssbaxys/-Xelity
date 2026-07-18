import { useParams } from 'react-router-dom';
import AdminUserInvestigation from './AdminUserInvestigation';

export default function AdminUserCase() {
  const { uid = '' } = useParams();
  return <AdminUserInvestigation uid={uid} source="case" />;
}
