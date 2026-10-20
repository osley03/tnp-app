import { createFileRoute } from '@tanstack/react-router';
import { Enquiries } from '@/components/dashboard/Enquiries';
export const Route=createFileRoute('/_authenticated/app/tenant/enquiries')({component:()=> <Enquiries role="tenant"/>});
