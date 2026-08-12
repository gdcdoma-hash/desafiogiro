# Payments admin cycle 2

- O painel lista pagamentos recentes e inscrições elegíveis para registro financeiro.
- O valor nasce do `price_snapshot` preservado na inscrição.
- Pagamento novo inicia como `PENDING`.
- Apenas pagamentos pendentes podem ser confirmados ou cancelados.
- Confirmar pagamento não altera automaticamente o ciclo da inscrição neste ciclo.
- Nenhum estoque é baixado automaticamente neste ciclo.
