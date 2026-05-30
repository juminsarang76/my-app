import { notFound } from 'next/navigation'
import { getPraiseByDate } from '@/app/lib/praise'
import PraiseClient from './PraiseClient'

export default async function PraiseDatePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const week = getPraiseByDate(date)

  if (!week) notFound()

  return <PraiseClient week={week} />
}
