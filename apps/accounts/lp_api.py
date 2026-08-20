"""apps/accounts/lp_api.py"""
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from .models import LP

class LPSerializer(serializers.ModelSerializer):
    commitment    = serializers.SerializerMethodField()
    contributed   = serializers.SerializerMethodField()
    distributions = serializers.SerializerMethodField()
    nav           = serializers.SerializerMethodField()
    type          = serializers.CharField(source="lp_type")
    class Meta:
        model = LP
        fields = ["id","fund","name","type","commitment","contributed","distributions","nav","entry_date"]
    def get_commitment(self,o):    return o.commitment_cents/100
    def get_contributed(self,o):   return o.contributed_cents/100
    def get_distributions(self,o): return o.distributions_cents/100
    def get_nav(self,o):           return o.nav_cents/100

class LPViewSet(viewsets.ModelViewSet):
    queryset = LP.objects.all()
    serializer_class = LPSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        qs = LP.objects.all()
        fund = self.request.query_params.get("fund")
        if fund: qs = qs.filter(fund_id=fund)
        return qs
