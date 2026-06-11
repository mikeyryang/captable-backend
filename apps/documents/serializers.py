"""apps/documents/serializers.py"""
from rest_framework import serializers
from .models import Document, Signature


class SignatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Signature
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at", "signed_at", "declined_at"]


class DocumentSerializer(serializers.ModelSerializer):
    signatures = SignatureSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        exclude = ["company"]
        read_only_fields = [
            "id", "created_at", "updated_at",
            "docusign_envelope_id", "docusign_status",
            "sent_at", "signed_at", "voided_at",
            "file_size",
        ]

    def get_file_url(self, obj):
        if obj.file:
            try:
                return obj.file.url
            except Exception:
                return None
        return None
