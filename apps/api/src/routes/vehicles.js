import { Router } from "express";
import {
  createVehicle, createVehicleAppraisal, createVehicleAuctionBid, createVehicleAuctionListing,
  createVehicleDisposition, createVehicleDocument, createVehicleValuation, deleteVehicle,
  getVehicle360, listVehicleAppraisals, listVehicleAuctionListings, listVehicleDispositions,
  listVehicleDocuments, listVehicleOwnership, listVehicleValuations, listVehicles, transferVehicleOwnership,
  updateVehicle, updateVehicleAppraisalStatus, updateVehicleAuctionListing, updateVehicleDisposition,
  updateVehicleDocumentStatus,
} from "../db.js";
import { asyncRoute, HttpError } from "../errors.js";
import { authorizePermission, CAPABILITIES } from "../permissions.js";
import {
  optionalIsoDateTime, optionalNumber, optionalString, requireEnum, requireNumber, requireString, requireUuid, paginationParams,
} from "../validate.js";

export const vehiclesRouter = Router();

const STOCK_STATUSES = ["active", "customer-owned", "in-stock", "demo", "reserved", "rental", "auction", "sold"];
const ACQUISITION_CHANNELS = ["trade-in", "auction-purchase", "direct-purchase", "consignment"];
const DOCUMENT_STATUSES = ["requested", "received", "verified", "rejected"];
const CONDITION_GRADES = ["excellent", "good", "fair", "poor"];
const APPRAISAL_STATUSES = ["draft", "offered", "accepted", "declined", "expired"];
const VALUATION_SOURCES = ["market", "trade", "wholesale", "manual"];
const AUCTION_LISTING_STATUSES = ["draft", "listed", "bidding", "sold", "unsold", "cancelled"];
const DISPOSITION_TYPES = ["rental", "demo"];
const DISPOSITION_STATUSES = ["active", "completed", "cancelled"];

vehiclesRouter.get("/", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const search = optionalString(request.query.q, 120);
  const status = optionalString(request.query.status, 40);
  const { limit, offset } = paginationParams(request.query);
  const vehicles = await listVehicles(request.auth.organizationId, { search, status, limit, offset });
  response.json({ vehicles });
}));

// Vehicle intake: adding a VIN to inventory, with where it came from and where it now sits.
vehiclesRouter.post("/", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const vin = requireString(request.body.vin, "VIN", { min: 5, max: 32 }).toUpperCase();
  const make = requireString(request.body.make, "Make", { min: 1, max: 60 });
  const model = requireString(request.body.model, "Model", { min: 1, max: 60 });
  const registration = optionalString(request.body.registration, 20);
  const variant = optionalString(request.body.variant, 60);
  const colour = optionalString(request.body.colour, 40);
  const modelYear = optionalNumber(request.body.modelYear);
  const odometerKm = optionalNumber(request.body.odometerKm);
  const marketValue = optionalNumber(request.body.marketValue);
  const status = request.body.status ? requireEnum(request.body.status, "Status", STOCK_STATUSES) : "active";
  const branchId = request.body.branchId ? requireUuid(request.body.branchId, "Branch id") : null;
  const lotLocation = optionalString(request.body.lotLocation, 120);
  const acquisitionChannel = request.body.acquisitionChannel ? requireEnum(request.body.acquisitionChannel, "Acquisition channel", ACQUISITION_CHANNELS) : null;
  const acquisitionCost = optionalNumber(request.body.acquisitionCost);
  const intakeAt = optionalIsoDateTime(request.body.intakeAt, "Intake date");
  const vehicle = await createVehicle(request.auth.organizationId, {
    vin, registration, make, model, variant, colour, modelYear, odometerKm, marketValue, status,
    branchId, lotLocation, acquisitionChannel, acquisitionCost, intakeAt,
  });
  response.status(201).json({ vehicle });
}));

vehiclesRouter.get("/:id/360", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const vehicle = await getVehicle360(request.auth.organizationId, id);
  if (!vehicle) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  response.json({ vehicle });
}));

// Also carries stock/location updates (branch, lot) and intake corrections (acquisition channel
// and cost) -- the Stock & Location tab PATCHes this same endpoint with just those fields.
vehiclesRouter.patch("/:id", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const registration = optionalString(request.body.registration, 20);
  const colour = optionalString(request.body.colour, 40);
  const odometerKm = optionalNumber(request.body.odometerKm);
  const marketValue = optionalNumber(request.body.marketValue);
  const status = request.body.status ? requireEnum(request.body.status, "Status", STOCK_STATUSES) : null;
  const branchId = request.body.branchId ? requireUuid(request.body.branchId, "Branch id") : null;
  const lotLocation = optionalString(request.body.lotLocation, 120);
  const acquisitionChannel = request.body.acquisitionChannel ? requireEnum(request.body.acquisitionChannel, "Acquisition channel", ACQUISITION_CHANNELS) : null;
  const acquisitionCost = optionalNumber(request.body.acquisitionCost);
  const vehicle = await updateVehicle(request.auth.organizationId, id, {
    registration, colour, odometerKm, marketValue, status, branchId, lotLocation, acquisitionChannel, acquisitionCost,
  });
  if (!vehicle) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  response.json({ vehicle });
}));

vehiclesRouter.delete("/:id", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const deleted = await deleteVehicle(request.auth.organizationId, id);
  if (!deleted) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  response.status(204).end();
}));

// ---------------------------------------------------------------------------
// Ownership history and transfer
// ---------------------------------------------------------------------------

vehiclesRouter.get("/:id/ownership", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const ownership = await listVehicleOwnership(request.auth.organizationId, id);
  response.json({ ownership });
}));

vehiclesRouter.post("/:id/ownership/transfer", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const customerId = requireUuid(request.body.customerId, "Customer id");
  const startedOn = optionalIsoDateTime(request.body.startedOn, "Transfer date");
  const transferReason = optionalString(request.body.transferReason, 200);
  const entry = await transferVehicleOwnership(request.auth.organizationId, id, { customerId, startedOn, transferReason, recordedBy: request.auth.userId });
  response.status(201).json({ ownership: entry });
}));

// ---------------------------------------------------------------------------
// Documents (metadata and a storage reference only -- see database/012_vehicle_360_core.sql)
// ---------------------------------------------------------------------------

vehiclesRouter.get("/:id/documents", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const { limit, offset } = paginationParams(request.query);
  const documents = await listVehicleDocuments(request.auth.organizationId, id, { limit, offset });
  response.json({ documents });
}));

vehiclesRouter.post("/:id/documents", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const documentType = requireString(request.body.documentType, "Document type", { min: 2, max: 60 });
  const label = requireString(request.body.label, "Label", { min: 2, max: 160 });
  const status = request.body.status ? requireEnum(request.body.status, "Status", DOCUMENT_STATUSES) : "received";
  const storageReference = optionalString(request.body.storageReference, 300);
  const document = await createVehicleDocument(request.auth.organizationId, id, {
    documentType, label, status, storageReference, uploadedBy: request.auth.userId,
  });
  response.status(201).json({ document });
}));

vehiclesRouter.patch("/:id/documents/:documentId", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const documentId = requireUuid(request.params.documentId, "Document id");
  const status = requireEnum(request.body.status, "Status", DOCUMENT_STATUSES);
  const document = await updateVehicleDocumentStatus(request.auth.organizationId, id, documentId, status);
  if (!document) throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
  response.json({ document });
}));

// ---------------------------------------------------------------------------
// Trade-in / acquisition appraisal
// ---------------------------------------------------------------------------

vehiclesRouter.get("/:id/appraisals", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const { limit, offset } = paginationParams(request.query);
  const appraisals = await listVehicleAppraisals(request.auth.organizationId, id, { limit, offset });
  response.json({ appraisals });
}));

vehiclesRouter.post("/:id/appraisals", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const customerId = request.body.customerId ? requireUuid(request.body.customerId, "Customer id") : null;
  const conditionGrade = requireEnum(request.body.conditionGrade, "Condition grade", CONDITION_GRADES);
  const odometerKm = optionalNumber(request.body.odometerKm);
  const exteriorNotes = optionalString(request.body.exteriorNotes, 500);
  const mechanicalNotes = optionalString(request.body.mechanicalNotes, 500);
  const offeredValue = optionalNumber(request.body.offeredValue);
  const status = request.body.status ? requireEnum(request.body.status, "Status", APPRAISAL_STATUSES) : "draft";
  const appraisal = await createVehicleAppraisal(request.auth.organizationId, id, {
    customerId, appraiserId: request.auth.userId, conditionGrade, odometerKm, exteriorNotes, mechanicalNotes, offeredValue, status,
  });
  response.status(201).json({ appraisal });
}));

vehiclesRouter.patch("/:id/appraisals/:appraisalId", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const appraisalId = requireUuid(request.params.appraisalId, "Appraisal id");
  const status = requireEnum(request.body.status, "Status", APPRAISAL_STATUSES);
  const appraisal = await updateVehicleAppraisalStatus(request.auth.organizationId, id, appraisalId, status, request.auth.userId);
  if (!appraisal) throw new HttpError(404, "APPRAISAL_NOT_FOUND", "Appraisal not found.");
  response.json({ appraisal });
}));

// ---------------------------------------------------------------------------
// Valuation history
// ---------------------------------------------------------------------------

vehiclesRouter.get("/:id/valuations", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const { limit, offset } = paginationParams(request.query);
  const valuations = await listVehicleValuations(request.auth.organizationId, id, { limit, offset });
  response.json({ valuations });
}));

vehiclesRouter.post("/:id/valuations", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const source = requireEnum(request.body.source, "Source", VALUATION_SOURCES);
  const value = requireNumber(request.body.value, "Value", { min: 0 });
  const notes = optionalString(request.body.notes, 300);
  const valuation = await createVehicleValuation(request.auth.organizationId, id, { source, value, notes, createdBy: request.auth.userId });
  response.status(201).json({ valuation });
}));

// ---------------------------------------------------------------------------
// Auction disposition
// ---------------------------------------------------------------------------

vehiclesRouter.get("/:id/auction-listings", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const { limit, offset } = paginationParams(request.query);
  const listings = await listVehicleAuctionListings(request.auth.organizationId, id, { limit, offset });
  response.json({ listings });
}));

vehiclesRouter.post("/:id/auction-listings", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const auctionHouse = optionalString(request.body.auctionHouse, 120);
  const reservePrice = optionalNumber(request.body.reservePrice);
  const closesAt = optionalIsoDateTime(request.body.closesAt, "Closing date");
  const status = request.body.status ? requireEnum(request.body.status, "Status", AUCTION_LISTING_STATUSES) : "draft";
  const listing = await createVehicleAuctionListing(request.auth.organizationId, id, { auctionHouse, reservePrice, closesAt, status, createdBy: request.auth.userId });
  response.status(201).json({ listing });
}));

vehiclesRouter.patch("/:id/auction-listings/:listingId", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const listingId = requireUuid(request.params.listingId, "Listing id");
  const status = request.body.status ? requireEnum(request.body.status, "Status", AUCTION_LISTING_STATUSES) : null;
  const reservePrice = optionalNumber(request.body.reservePrice);
  const closesAt = optionalIsoDateTime(request.body.closesAt, "Closing date");
  const soldPrice = optionalNumber(request.body.soldPrice);
  const buyerNote = optionalString(request.body.buyerNote, 300);
  const listing = await updateVehicleAuctionListing(request.auth.organizationId, id, listingId, { status, reservePrice, closesAt, soldPrice, buyerNote });
  if (!listing) throw new HttpError(404, "AUCTION_LISTING_NOT_FOUND", "Auction listing not found.");
  response.json({ listing });
}));

vehiclesRouter.post("/:id/auction-listings/:listingId/bids", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const listingId = requireUuid(request.params.listingId, "Listing id");
  const bidderName = requireString(request.body.bidderName, "Bidder name", { min: 1, max: 160 });
  const amount = requireNumber(request.body.amount, "Amount", { min: 0 });
  const bid = await createVehicleAuctionBid(request.auth.organizationId, id, listingId, { bidderName, amount });
  response.status(201).json({ bid });
}));

// ---------------------------------------------------------------------------
// Rental / demo disposition
// ---------------------------------------------------------------------------

vehiclesRouter.get("/:id/dispositions", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const { limit, offset } = paginationParams(request.query);
  const dispositions = await listVehicleDispositions(request.auth.organizationId, id, { limit, offset });
  response.json({ dispositions });
}));

vehiclesRouter.post("/:id/dispositions", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const dispositionType = requireEnum(request.body.dispositionType, "Disposition type", DISPOSITION_TYPES);
  const customerId = request.body.customerId ? requireUuid(request.body.customerId, "Customer id") : null;
  const startsAt = optionalIsoDateTime(request.body.startsAt, "Start date");
  const odometerOut = optionalNumber(request.body.odometerOut);
  const notes = optionalString(request.body.notes, 300);
  const disposition = await createVehicleDisposition(request.auth.organizationId, id, {
    dispositionType, customerId, startsAt, odometerOut, notes, createdBy: request.auth.userId,
  });
  response.status(201).json({ disposition });
}));

vehiclesRouter.patch("/:id/dispositions/:dispositionId", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const dispositionId = requireUuid(request.params.dispositionId, "Disposition id");
  const status = requireEnum(request.body.status, "Status", DISPOSITION_STATUSES);
  const odometerIn = optionalNumber(request.body.odometerIn);
  const notes = optionalString(request.body.notes, 300);
  const disposition = await updateVehicleDisposition(request.auth.organizationId, id, dispositionId, { status, odometerIn, notes });
  if (!disposition) throw new HttpError(404, "DISPOSITION_NOT_FOUND", "Disposition not found.");
  response.json({ disposition });
}));

export { STOCK_STATUSES };
