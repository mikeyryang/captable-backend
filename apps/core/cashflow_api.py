"""apps/core/cashflow_api.py"""
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Cashflow

class CashflowSerializer(serializers.ModelSerializer):
    amount = serializers.SerializerMethodField()
    class Meta:
        model = Cashflow
        fields = ["id","fund","type","label","amount","date"]
    def get_amount(self, obj):
        return obj.amount

class CashflowViewSet(viewsets.ModelViewSet):
    queryset = Cashflow.objects.all()
    serializer_class = CashflowSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        qs = Cashflow.objects.all()
        fund = self.request.query_params.get("fund")
        if fund: qs = qs.filter(fund_id=fund)
        return qs
