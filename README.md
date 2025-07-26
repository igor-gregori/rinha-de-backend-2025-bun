Tentar trabalhar eventos e workers no bun

Vou trabalhar com sqlite, cada instancia vai ter a sua
Quando eu for pegar o resultado dos pagamentos, a instancia primária vai perguntar pra secundária, somar os valores e retornar os resultados.

A instancia primária também vai ficar responsável por ficar checando se os processadores estão funcionando

<!-- SELECT processed_by, COUNT(*) AS total_pagamentos, SUM(amount) AS total_amount
FROM processed_payments
GROUP BY processed_by; -->
