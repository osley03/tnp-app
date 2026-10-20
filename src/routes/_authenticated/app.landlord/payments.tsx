import {createFileRoute} from "@tanstack/react-router";
import {RentalPaymentPage} from "@/modules/payments/RentalPaymentPage";
export const Route=createFileRoute("/_authenticated/app/landlord/payments")({component:()=> <RentalPaymentPage role="landlord"/>});
