import { createFileRoute } from '@tanstack/react-router';
import { Enquiries } from '@/components/dashboard/Enquiries';
export const Route=createFileRoute('/_authenticated/app/landlord/enquiries')({component:()=> <Enquiries role="landlord"/>});
