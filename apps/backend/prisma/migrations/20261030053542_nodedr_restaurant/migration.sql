-- RenameIndex
ALTER INDEX "verifactu_records_chain_key" RENAME TO "verifactu_records_restaurantId_issuerNif_environment_seq_key";

-- RenameIndex
ALTER INDEX "verifactu_records_number_key" RENAME TO "verifactu_records_restaurantId_issuerNif_environment_invoic_key";
