import {createFileRoute} from "@tanstack/react-router";
import {RentalPaymentPage} from "@/modules/payments/RentalPaymentPage";
export const Route=createFileRoute("/_authenticated/app/tenant/payments")({component:()=> <RentalPaymentPage role="tenant"/>});
