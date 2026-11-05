import { defineLink } from "@medusajs/framework/utils";
import OrderModule from "@medusajs/medusa/order";
import CompanyModule from "../modules/company";

// A company has many orders; an order belongs to one company.
// (Was one-to-one, which made every order after a company's first fail with
// "Cannot create multiple links between 'order' and 'company'".)
export default defineLink(
  { linkable: OrderModule.linkable.order, isList: true },
  CompanyModule.linkable.company
);
