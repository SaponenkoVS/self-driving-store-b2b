import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listApprovals, retrieveMyCompany } from "@lib/data/companies"
import { retrieveCustomer } from "@lib/data/customer"
import AddEmployeeForm from "@modules/account/components/company/add-employee-form"
import ApprovalsList from "@modules/account/components/company/approvals-list"
import CompanyDetails from "@modules/account/components/company/company-details"
import CompanyStatusBanner from "@modules/account/components/company/company-status-banner"
import EmployeesTable from "@modules/account/components/company/employees-table"
import { eyebrow } from "@modules/account/components/company/format"
import NoCompany from "@modules/account/components/company/no-company"

export const metadata: Metadata = {
  title: "Company",
  description: "Your company trade account, terms and employees.",
}

export default async function CompanyPage() {
  const customer = await retrieveCustomer().catch(() => null)

  if (!customer) {
    notFound()
  }

  const data = await retrieveMyCompany()

  if (!data) {
    return <NoCompany customer={customer} />
  }

  const isAdmin = data.employee?.role === "admin"
  const approvals = await listApprovals()

  return (
    <div className="flex w-full flex-col gap-6" data-testid="company-page-wrapper">
      <div>
        <p className={eyebrow}>Trade account</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">{data.company.name}</h1>
        <p className="mt-1 text-sm text-ink-600">
          {isAdmin
            ? "Manage company details, buyers and their spending limits."
            : "Your company terms and buyer limits. Ask a company administrator to change them."}
        </p>
      </div>
      <CompanyStatusBanner showLink={false} />
      <CompanyDetails company={data.company} />
      <EmployeesTable
        employees={data.company.employees}
        currencyCode={data.company.currency_code}
        isAdmin={isAdmin}
        myCustomerId={customer.id}
      />
      {isAdmin && <AddEmployeeForm />}
      <ApprovalsList approvals={approvals} isAdmin={isAdmin} myCustomerId={customer.id} />
    </div>
  )
}
